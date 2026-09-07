import frappe
from frappe import _
from frappe.utils import cstr

# the only fields the editor may set; a new Slide field is not client-writable by default
SLIDE_FIELDS = frozenset(
    {
        "client_id",
        "background",
        "elements",
        "transition",
        "transition_duration",
        "fade_unmatched_elements",
    }
)


# a save over GET would report success and then be rolled back after responding
@frappe.whitelist(methods=["POST"])
def save_slides(name: str, slides: list[dict], base_modified: str) -> dict:
    """Replace a presentation's slides with the editor's list.

    Rows are matched by `client_id`, the identity the editor owns, so a slide it
    created keeps one row across autosaves instead of being re-inserted each time.
    `base_modified` is the version the editor built on: anything older than the
    server's is a stale snapshot that would wipe another editor's rows, so it is
    refused rather than merged.
    """
    doc = frappe.get_doc("Presentation", name)
    doc.check_permission("write")
    if doc.is_composite:
        frappe.throw(_("Composite presentations have no slides of their own"))
    if cstr(doc.modified) != cstr(base_modified):
        frappe.throw(
            _("This presentation was changed elsewhere. Reload to get the latest version."),
            frappe.TimestampMismatchError,
        )

    doc.set("slides", merge_rows(doc.slides, slides))
    doc.save()
    return {"modified": doc.modified}


def merge_rows(existing_rows, incoming):
    """Rows match on client_id; anything unmatched is inserted."""
    by_client_id = {row.client_id: row for row in existing_rows if row.client_id}
    rows = []
    for idx, slide in enumerate(incoming, start=1):
        values = {field: slide.get(field) for field in SLIDE_FIELDS if field in slide}
        row = by_client_id.pop(values.get("client_id"), None)
        if row:
            row.update(values)
        else:
            row = frappe.new_doc("Slide").update(values)
        row.idx = idx
        rows.append(row)
    return rows
