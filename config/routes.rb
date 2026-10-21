ModelMap::Engine.routes.draw do
  root to: "maps#show"
  get "schema", to: "maps#schema", as: :schema
  get "fingerprint", to: "maps#fingerprint", as: :fingerprint
  get "export", to: "maps#export", as: :export
  get "store", to: "stores#show", as: :store
  put "store", to: "stores#update"
  get "assets/:file", to: "assets#show", as: :asset_file, constraints: { file: /[A-Za-z0-9_.-]+/ }, format: false
end
