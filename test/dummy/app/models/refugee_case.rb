class RefugeeCase < Case
  validates :unhcr_reference, presence: true, if: -> { intake? }
end
