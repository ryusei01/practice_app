"""
AI学習プラン生成（Gemini → Hugging Face → Groq のフォールバック）。

JSON のみでプランを返すよう誘導する。パース失敗時は goal / weeks / daily_hours から汎用プランを組み立てる。
"""
import json
import logging
import re
from typing import Any, List, Optional

from .llm_router import AllLLMProvidersFailed, complete_text

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a study coach for a quiz/practice app. Create a practical weekly study plan.

Rules:
- Output ONLY a single valid JSON object. No markdown fences, no commentary before or after.
- Use Japanese for all user-facing strings (theme, milestone, task strings).
- The JSON must match this shape exactly:
{
  "goal": "<same as user goal, can be shortened>",
  "weeks": [
    {
      "week": 1,
      "theme": "short theme for the week",
      "milestone": "concrete milestone for end of week",
      "days": [
        { "day": 1, "tasks": ["task1", "task2"] },
        { "day": 2, "tasks": ["task1"] }
      ]
    }
  ]
}
- weeks array length MUST equal the requested number of weeks.
- Each week must have exactly 7 days (day 1..7). Each day has 1-4 tasks.
- If you are unsure about subject-specific details (e.g. exact vocabulary lists), use GENERIC tasks only, such as:
  "復習（間違えた問題）", "演習（問題集）", "模試またはタイムトライアル", "弱点分野の復習", "振り返りとメモ整理".
- Respect daily_hours: keep daily workload realistic for that many hours per day (rough estimate).
- If weak_categories is non-empty, mention addressing them across weeks without inventing copyrighted material.
"""


def _fallback_plan(goal: str, weeks: int, daily_hours: float, weak_categories: List[str]) -> dict:
    w = max(1, min(24, int(weeks)))
    weak_note = ""
    if weak_categories:
        weak_note = "（弱点: " + "、".join(weak_categories[:5]) + "）"

    out_weeks = []
    for wi in range(1, w + 1):
        days = []
        for di in range(1, 8):
            tasks = [
                f"演習（{daily_hours:.1f}時間目安）",
                "復習（不正解・迷った問題）",
            ]
            if di in (3, 6):
                tasks.append("模試またはタイムトライアル")
            if weak_categories and di == 2:
                tasks.append("弱点分野の復習" + weak_note)
            days.append({"day": di, "tasks": tasks[:3]})
        out_weeks.append(
            {
                "week": wi,
                "theme": f"第{wi}週: 演習と復習のサイクル",
                "milestone": f"第{wi}週末: 演習量を維持し、復習リストを整理する",
                "days": days,
            }
        )
    return {"goal": goal, "weeks": out_weeks}


def _extract_json_object(raw: str) -> Optional[dict]:
    if not raw or not raw.strip():
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass
    m = re.search(r"\{[\s\S]*\}", raw)
    if not m:
        return None
    try:
        return json.loads(m.group())
    except json.JSONDecodeError:
        return None


def _normalize_plan(data: Any, goal: str, weeks: int) -> Optional[dict]:
    if not isinstance(data, dict):
        return None
    g = data.get("goal")
    if not isinstance(g, str) or not g.strip():
        g = goal
    wk = data.get("weeks")
    if not isinstance(wk, list) or len(wk) == 0:
        return None
    out_weeks = []
    for i, item in enumerate(wk[:weeks]):
        if not isinstance(item, dict):
            continue
        week_num = item.get("week")
        try:
            week_num = int(week_num)
        except (TypeError, ValueError):
            week_num = i + 1
        theme = item.get("theme")
        if not isinstance(theme, str):
            theme = f"第{week_num}週"
        milestone = item.get("milestone")
        if not isinstance(milestone, str):
            milestone = f"第{week_num}週の振り返り"
        days_in = item.get("days")
        days_out = []
        if isinstance(days_in, list):
            for j, d in enumerate(days_in[:7]):
                if not isinstance(d, dict):
                    continue
                day_idx = d.get("day")
                try:
                    day_idx = int(day_idx)
                except (TypeError, ValueError):
                    day_idx = j + 1
                tasks_in = d.get("tasks")
                tasks_out: List[str] = []
                if isinstance(tasks_in, list):
                    for t in tasks_in[:4]:
                        if isinstance(t, str) and t.strip():
                            tasks_out.append(t.strip())
                if not tasks_out:
                    tasks_out = ["演習（問題集）", "復習（間違い）"]
                days_out.append({"day": day_idx, "tasks": tasks_out})
        while len(days_out) < 7:
            days_out.append(
                {
                    "day": len(days_out) + 1,
                    "tasks": ["演習（問題集）", "復習（間違い）"],
                }
            )
        out_weeks.append(
            {
                "week": week_num,
                "theme": theme,
                "milestone": milestone,
                "days": days_out[:7],
            }
        )
    if len(out_weeks) != weeks:
        return None
    return {"goal": g.strip(), "weeks": out_weeks}


class LearningPlanGenerator:
    def __init__(self) -> None:
        self.timeout = 180.0

    async def generate(
        self,
        goal: str,
        weeks: int,
        daily_hours: float,
        weak_categories: Optional[List[str]] = None,
    ) -> dict:
        weak_categories = weak_categories or []
        w = max(1, min(24, int(weeks)))
        dh = float(daily_hours)
        if dh < 0.25:
            dh = 0.25
        if dh > 24:
            dh = 24.0

        weak_line = (
            "Weak categories (optional): " + ", ".join(weak_categories)
            if weak_categories
            else "Weak categories: (none)"
        )
        user_block = (
            f"User goal: {goal}\n"
            f"Number of weeks: {w}\n"
            f"Daily study hours (approx): {dh}\n"
            f"{weak_line}\n"
        )
        user = f"{user_block}\nJSON:"

        logger.info("Calling cloud LLM for learning plan: weeks=%s", w)

        try:
            raw, _provider = await complete_text(
                system=SYSTEM_PROMPT,
                user=user,
                temperature=0.35,
                max_tokens=4096,
                timeout=self.timeout,
            )
        except AllLLMProvidersFailed as e:
            logger.warning("Learning plan: all LLM providers failed: %s", e)
            raise

        raw = raw or ""
        parsed = _extract_json_object(raw)
        normalized = _normalize_plan(parsed, goal=goal, weeks=w) if parsed else None
        if normalized:
            normalized["raw_response"] = raw
            return normalized

        logger.warning("Learning plan JSON parse/normalize failed; using fallback. raw[:200]=%s", raw[:200])
        fb = _fallback_plan(goal, w, dh, weak_categories)
        fb["raw_response"] = raw
        fb["fallback"] = True
        return fb


_generator: Optional[LearningPlanGenerator] = None


def get_learning_plan_generator() -> LearningPlanGenerator:
    global _generator
    if _generator is None:
        _generator = LearningPlanGenerator()
    return _generator
