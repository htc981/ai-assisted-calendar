"""
Natural Language Parser Service

Uses OpenAI to parse free-form text into structured event objects.
"""

import json
import re
from typing import List, Optional
from openai import OpenAI
from ..config import settings
from ..schemas import ParsedEvent


# Prompt for LLM to parse natural language into events
PARSE_PROMPT = """
You are an assistant that parses natural language text into structured calendar events.

Current time: {current_time}
Timezone: Local time (all times mentioned by user are in their local timezone)

Extract events from the user's text and return them as a JSON array wrapped in markdown code blocks.

For each event, extract:
- title: A concise title for the event (required)
- description: Additional details or context (optional)
- priority: Integer 1-5, where 1 is highest priority (default: 3)
  - Priority 1: Urgent deadlines, critical meetings
  - Priority 2: Important meetings, time-sensitive tasks
  - Priority 3: Regular tasks, standard meetings
  - Priority 4: Non-urgent tasks, nice-to-have meetings
  - Priority 5: Low priority, can be deferred
- estimated_duration: Estimated duration in minutes (optional, default: 60)
  - Use context clues: "quick call" = 15-30 min, "meeting" = 30-60 min, "workshop" = 120+ min
- participant_emails: List of email addresses mentioned (optional)
- time_preferences: Any time-related preferences from the text (optional)
  - Examples: "tomorrow at 2pm", "next Monday morning", "before 5pm today"

**IMPORTANT - Time Context Rules:**
1. When the user specifies a parent time context (e.g., "My schedule for tomorrow:", "Next week:", "Monday:"), ALL events under that context inherit that date/day
2. Relative times like "at 9am", "at noon" refer to the parent context's date, NOT today
3. Example: "My schedule for tomorrow: - Meeting at 9am - Lunch at noon" → BOTH events are tomorrow, not today
4. Always check if there's a parent time context before assigning dates to events

Rules:
1. Each bullet point or sentence describing a task should be a separate event
2. Infer reasonable durations based on event type
3. Extract email addresses if present (format: name@domain.com)
4. Preserve any time constraints or preferences in the time_preferences field
5. If no priority is implied, use 3 as default
6. **CRITICAL**: Pay attention to parent time contexts - events listed under a time header ALL belong to that time period

Return the JSON array wrapped in markdown code blocks like this:
```json
[
  {{
    "title": "Event Title",
    "description": "Description",
    "priority": 3,
    "estimated_duration": 60,
    "participant_emails": [],
    "time_preferences": "tomorrow at 2pm"
  }}
]
```

Example 1 - Single events:
Input: "I need to have a 1-hour meeting with John about the budget review, preferably tomorrow morning. Also, I should finish the presentation slides by end of week."
Output:
```json
[
  {{
    "title": "Budget Review Meeting",
    "description": "With John",
    "priority": 3,
    "estimated_duration": 60,
    "participant_emails": [],
    "time_preferences": "tomorrow morning"
  }},
  {{
    "title": "Finish Presentation Slides",
    "description": "Deadline: end of week",
    "priority": 4,
    "estimated_duration": 120,
    "participant_emails": [],
    "time_preferences": ""
  }}
]
```

Example 2 - Parent time context (IMPORTANT):
Input: "My schedule for tomorrow:
- Standup meeting at 9am
- Lunch with client at noon
- Code review at 3pm"
Output:
```json
[
  {{
    "title": "Standup Meeting",
    "description": "",
    "priority": 3,
    "estimated_duration": 30,
    "participant_emails": [],
    "time_preferences": "tomorrow at 9am"
  }},
  {{
    "title": "Lunch with Client",
    "description": "",
    "priority": 3,
    "estimated_duration": 60,
    "participant_emails": [],
    "time_preferences": "tomorrow at noon"
  }},
  {{
    "title": "Code Review",
    "description": "",
    "priority": 3,
    "estimated_duration": 60,
    "participant_emails": [],
    "time_preferences": "tomorrow at 3pm"
  }}
]
```
Note: ALL events inherit "tomorrow" from the parent context "My schedule for tomorrow:".

User input:
{user_text}
""".strip()


def parse_natural_language(text: str) -> List[ParsedEvent]:
    """
    Parse natural language text into structured events using OpenAI.
    
    Args:
        text: Free-form text describing events/tasks
        
    Returns:
        List of ParsedEvent objects
        
    Raises:
        Exception: If parsing fails after retries
    """
    if not settings.OPENAI_API_KEY:
        raise Exception("OpenAI API key not configured")

    client = OpenAI(
        api_key=settings.OPENAI_API_KEY,
        base_url=settings.OPENAI_BASE_URL
    )

    # Format the prompt with current time context
    from datetime import datetime
    now = datetime.now()

    prompt = PARSE_PROMPT.format(
        user_text=text,
        current_time=now.strftime("%Y-%m-%d %H:%M:%S")
    )

    # Retry mechanism for LLM call + re-parse loop
    max_retries = 3
    last_error = None

    for attempt in range(max_retries):
        try:
            # Call OpenAI API
            response = client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": "You are a helpful assistant that parses text into JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=4000
            )

            # Extract response
            content = response.choices[0].message.content.strip()

            # Try to parse as JSON
            try:
                events_data = json.loads(content)
            except json.JSONDecodeError:
                # Try to extract JSON from markdown code block
                json_match = re.search(r'```json\s*(.*?)\s*```', content, re.DOTALL)
                if json_match:
                    events_data = json.loads(json_match.group(1))
                else:
                    # Fallback: try to find any JSON array
                    json_match = re.search(r'\[.*?\]', content, re.DOTALL)
                    if json_match:
                        events_data = json.loads(json_match.group())
                    else:
                        raise Exception(f"Failed to parse JSON from response: {content[:200]}")

            # Convert to ParsedEvent objects
            parsed_events = []
            for event_data in events_data:
                if not isinstance(event_data, dict):
                    continue
                parsed_events.append(ParsedEvent(
                    title=event_data.get("title", "Untitled Event"),
                    description=event_data.get("description"),
                    priority=min(5, max(1, int(event_data.get("priority", 3) or 3))),
                    estimated_duration=event_data.get("estimated_duration"),
                    participant_emails=event_data.get("participant_emails") or [],
                    time_preferences=event_data.get("time_preferences")
                ))

            if parsed_events:
                return parsed_events
            else:
                last_error = Exception("No valid events parsed from response")

        except Exception as e:
            last_error = e
            print(f"[NL Parser] Attempt {attempt + 1}/{max_retries} failed: {e}")
            if attempt < max_retries - 1:
                import time
                time.sleep(0.5 * (attempt + 1))  # Exponential backoff
            continue

    # All retries failed
    raise Exception(f"Failed to parse natural language after {max_retries} attempts: {last_error}")
