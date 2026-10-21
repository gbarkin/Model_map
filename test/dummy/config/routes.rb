Rails.application.routes.draw do
  mount ModelMap::Engine => "/model_map" if defined?(ModelMap::Engine)
  root to: redirect("/model_map")
end
