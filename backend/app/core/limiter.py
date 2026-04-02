"""
slowapi レート制限インスタンス（循環インポート回避のための共有モジュール）
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
