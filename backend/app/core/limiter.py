"""
slowapi レート制限インスタンス（循環インポート回避のための共有モジュール）
"""
from slowapi import Limiter

from .client_ip import get_client_ip

limiter = Limiter(key_func=get_client_ip)
