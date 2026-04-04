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
  - Examples: "morning", "afternoon", "before 5pm", "after lunch"

Rules:
1. Each bullet point or sentence describing a task should be a separate event
2. Infer reasonable durations based on event type
3. Extract email addresses if present (format: name@domain.com)
4. Preserve any time constraints or preferences in the description or time_preferences field
5. If no priority is implied, use 3 as default

Return the JSON array wrapped in markdown code blocks like this:
```json
[
  {{
    "title": "Event Title",
    "description": "Description",
    "priority": 3,
    "estimated_duration": 60,
    "participant_emails": [],
    "time_preferences": "morning"
  }}
]
```

Example input:
"I need to have a 1-hour meeting with John about the budget review, preferably tomorrow morning. Also, I should finish the presentation slides by end of week."

Example output:
```json
[
  {{
    "title": "Budget Review Meeting",
    "description": "With John. Prefer tomorrow morning.",
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

User input:
{user_text}
"""


def parse_natural_language(text: str) -> List[ParsedEvent]:
    """
    Parse natural language text into structured events using OpenAI.
    
    Args:
        text: Free-form text describing events/tasks
        
    Returns:
        List of ParsedEvent objects
        
    Raises:
        Exception: If parsing fails
    """
    if not settings.OPENAI_API_KEY:
        raise Exception("OpenAI API key not configured")

    client = OpenAI(
        api_key=settings.OPENAI_API_KEY,
        base_url=settings.OPENAI_BASE_URL
    )
    
    # Format the prompt
    prompt = PARSE_PROMPT.format(user_text=text)
    
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

        return parsed_events

    except Exception as e:
        raise Exception(f"Failed to parse natural language: {type(e).__name__}: {str(e)}")
