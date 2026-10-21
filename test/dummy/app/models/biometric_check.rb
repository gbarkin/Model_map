class BiometricCheck < VettingCheck
  has_many :documents, as: :attachable, dependent: :destroy
end
