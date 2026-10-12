"""Launch gates. Author: Jonathan Kakesa (JonathanK-N)."""
import os


def integrated_payments_enabled():
    return os.environ.get("CINETPAY_ENABLED", "false").lower() == "true"


def legacy_checkout_enabled():
    return os.environ.get("COMMERCE_CHECKOUT_MODE", "direct").lower() == "legacy-compatible"


def legacy_financial_actions_enabled():
    return os.environ.get("LEGACY_FINANCIAL_ACTIONS_ENABLED", "false").lower() == "true"
