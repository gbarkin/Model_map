ModelMap.configure do |config|
  config.title = "Case management (sample)"
  config.group "People", "Person", "Address", "Relationship"
  config.group "Cases", "Case", "AsylumCase", "RefugeeCase", "Interview", "Tag", "Appeal"
  config.group "Vetting", /Check\z/
  config.group "Referrals", "Referral*"
  config.group "Records", "Note", "Document"
  config.group "Staff", "User"
  config.exclude = ["Archive::*"]
end
