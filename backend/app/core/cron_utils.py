"""
Cron表达式工具模块

提供Cron表达式的验证、人性化描述和下次执行时间计算功能。

实现需求:
- 1.3: 提供Cron表达式输入框，并显示表达式含义的人性化描述
- 1.6: 无效的Cron表达式应显示错误提示并阻止提交
- 2.3: 显示任务的下次执行时间
"""

from datetime import datetime
from typing import Optional, Tuple

from apscheduler.triggers.cron import CronTrigger


class CronValidationError(Exception):
    """Cron表达式验证错误"""
    pass


def validate_cron_expression(cron_expression: str) -> Tuple[bool, Optional[str]]:
    """
    验证Cron表达式有效性
    
    Args:
        cron_expression: Cron表达式字符串（5字段格式：分 时 日 月 周）
        
    Returns:
        Tuple[bool, Optional[str]]: (是否有效, 错误信息)
        
    Examples:
        >>> validate_cron_expression("0 9 * * *")
        (True, None)
        >>> validate_cron_expression("invalid")
        (False, "Cron表达式格式错误: ...")
    """
    if not cron_expression or not isinstance(cron_expression, str):
        return False, "Cron表达式不能为空"
    
    cron_expression = cron_expression.strip()
    
    if not cron_expression:
        return False, "Cron表达式不能为空"
    
    try:
        # 使用APScheduler的CronTrigger来验证表达式
        CronTrigger.from_crontab(cron_expression)
        return True, None
    except ValueError as e:
        return False, f"Cron表达式格式错误: {str(e)}"
    except Exception as e:
        return False, f"Cron表达式验证失败: {str(e)}"


def describe_cron_expression(cron_expression: str) -> str:
    """
    生成Cron表达式的人性化描述
    
    Args:
        cron_expression: Cron表达式字符串（5字段格式：分 时 日 月 周）
        
    Returns:
        str: 人性化描述
        
    Raises:
        CronValidationError: 当Cron表达式无效时
        
    Examples:
        >>> describe_cron_expression("0 9 * * *")
        "每天 09:00 执行"
        >>> describe_cron_expression("30 9 * * 1-5")
        "每周一至周五 09:30 执行"
    """
    is_valid, error = validate_cron_expression(cron_expression)
    if not is_valid:
        raise CronValidationError(error)
    
    cron_expression = cron_expression.strip()
    parts = cron_expression.split()
    
    if len(parts) != 5:
        raise CronValidationError("Cron表达式必须包含5个字段")
    
    minute, hour, day, month, weekday = parts
    
    # 构建描述
    descriptions = []
    
    # 处理月份
    month_desc = _describe_month(month)
    if month_desc:
        descriptions.append(month_desc)
    
    # 处理日期
    day_desc = _describe_day(day)
    if day_desc:
        descriptions.append(day_desc)
    
    # 处理星期
    weekday_desc = _describe_weekday(weekday)
    if weekday_desc:
        descriptions.append(weekday_desc)
    
    # 处理时间
    time_desc = _describe_time(hour, minute)
    descriptions.append(time_desc)
    
    # 组合描述
    if not descriptions[:-1]:  # 只有时间描述
        return f"每天 {time_desc}"
    
    return " ".join(descriptions)


def get_next_run_time(
    cron_expression: str,
    base_time: Optional[datetime] = None,
    timezone: str = "Asia/Shanghai"
) -> Optional[datetime]:
    """
    计算下次执行时间
    
    Args:
        cron_expression: Cron表达式字符串
        base_time: 基准时间，默认为当前时间
        timezone: 时区，默认为Asia/Shanghai
        
    Returns:
        Optional[datetime]: 下次执行时间，如果表达式无效则返回None
        
    Examples:
        >>> get_next_run_time("0 9 * * *")
        datetime(2025, 1, 2, 9, 0, 0)  # 假设当前是2025-01-01 10:00
    """
    is_valid, _ = validate_cron_expression(cron_expression)
    if not is_valid:
        return None
    
    try:
        trigger = CronTrigger.from_crontab(cron_expression, timezone=timezone)
        
        if base_time is None:
            base_time = datetime.now()
        
        # 获取下次执行时间
        next_time = trigger.get_next_fire_time(None, base_time)
        return next_time
    except Exception:
        return None


def _describe_month(month: str) -> str:
    """描述月份字段"""
    if month == "*":
        return ""
    
    month_names = {
        "1": "一月", "2": "二月", "3": "三月", "4": "四月",
        "5": "五月", "6": "六月", "7": "七月", "8": "八月",
        "9": "九月", "10": "十月", "11": "十一月", "12": "十二月"
    }
    
    if month in month_names:
        return month_names[month]
    
    if "-" in month:
        start, end = month.split("-", 1)
        start_name = month_names.get(start, start)
        end_name = month_names.get(end, end)
        return f"{start_name}至{end_name}"
    
    if "," in month:
        months = month.split(",")
        month_list = [month_names.get(m.strip(), m.strip()) for m in months]
        return "、".join(month_list)
    
    if "/" in month:
        _, step = month.split("/", 1)
        return f"每{step}个月"
    
    return ""


def _describe_day(day: str) -> str:
    """描述日期字段"""
    if day == "*":
        return ""
    
    if day.isdigit():
        return f"每月{day}日"
    
    if "-" in day:
        start, end = day.split("-", 1)
        return f"每月{start}日至{end}日"
    
    if "," in day:
        days = day.split(",")
        return f"每月{','.join(days)}日"
    
    if "/" in day:
        _, step = day.split("/", 1)
        return f"每{step}天"
    
    return ""


def _describe_weekday(weekday: str) -> str:
    """描述星期字段"""
    if weekday == "*":
        return ""
    
    weekday_names = {
        "0": "周日", "1": "周一", "2": "周二", "3": "周三",
        "4": "周四", "5": "周五", "6": "周六", "7": "周日",
        "sun": "周日", "mon": "周一", "tue": "周二", "wed": "周三",
        "thu": "周四", "fri": "周五", "sat": "周六"
    }
    
    weekday_lower = weekday.lower()
    
    if weekday_lower in weekday_names:
        return f"每{weekday_names[weekday_lower]}"
    
    if "-" in weekday:
        start, end = weekday.split("-", 1)
        start_name = weekday_names.get(start.lower(), start)
        end_name = weekday_names.get(end.lower(), end)
        return f"每{start_name}至{end_name}"
    
    if "," in weekday:
        days = weekday.split(",")
        day_list = [weekday_names.get(d.strip().lower(), d.strip()) for d in days]
        return f"每{','.join(day_list)}"
    
    if "/" in weekday:
        _, step = weekday.split("/", 1)
        return f"每{step}天"
    
    return ""


def _describe_time(hour: str, minute: str) -> str:
    """描述时间字段"""
    # 处理小时
    if hour == "*":
        hour_desc = "每小时"
        if minute == "*":
            return "每分钟执行"
        elif minute.isdigit():
            return f"每小时的第{minute}分钟执行"
        elif "/" in minute:
            _, step = minute.split("/", 1)
            return f"每{step}分钟执行"
        else:
            return f"每小时的{minute}分执行"
    
    if "/" in hour:
        _, step = hour.split("/", 1)
        if minute == "*":
            return f"每{step}小时执行"
        elif minute.isdigit():
            return f"每{step}小时的第{minute}分钟执行"
        else:
            return f"每{step}小时执行"
    
    # 处理具体时间
    if hour.isdigit() and minute.isdigit():
        return f"{int(hour):02d}:{int(minute):02d} 执行"
    
    if "-" in hour:
        start, end = hour.split("-", 1)
        if minute.isdigit():
            return f"{start}点至{end}点的第{minute}分钟执行"
        else:
            return f"{start}点至{end}点执行"
    
    if "," in hour:
        hours = hour.split(",")
        if minute.isdigit():
            return f"{','.join(hours)}点的第{minute}分钟执行"
        else:
            return f"{','.join(hours)}点执行"
    
    return f"{hour}:{minute} 执行"
