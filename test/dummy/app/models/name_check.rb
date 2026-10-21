class NameCheck < VettingCheck
  validates :result_code, inclusion: { in: %w[NR PH CH], allow_nil: true }
end
