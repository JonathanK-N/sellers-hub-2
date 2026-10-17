"""Shared delivery affiliation checks."""
def can_assign(profile, seller_id):
    if not profile or not profile.get("is_active", False):
        return False
    return profile.get("affiliation") == "afrimarket" or (
        profile.get("affiliation") == "shop" and profile.get("seller_id") == seller_id)


def compatible(profile, affiliation, seller_id):
    return not profile or (profile.get("affiliation") == affiliation and
        (affiliation != "shop" or profile.get("seller_id") == seller_id))
