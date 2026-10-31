from celery import shared_task
from .services import run_recurring_billing_all_due

@shared_task
def process_recurring_billing():
    """Celery scheduled task running recurring billing."""
    invoices_generated = run_recurring_billing_all_due()
    return f"Generated {invoices_generated} invoices."

