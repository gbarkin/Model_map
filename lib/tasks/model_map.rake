namespace :model_map do
  desc "Print the introspected model schema as JSON (OUT=path to write a file)"
  task schema: :environment do
    json = JSON.pretty_generate(ModelMap::Introspector.new.call)
    if ENV["OUT"]
      File.write(ENV["OUT"], json)
      puts "Wrote #{ENV["OUT"]}"
    else
      puts json
    end
  end

  desc "Write a standalone, offline HTML copy of the model map (OUT=path, default tmp/model_map.html)"
  task export: :environment do
    out = ENV["OUT"] || Rails.root.join("tmp", "model_map.html").to_s
    FileUtils.mkdir_p(File.dirname(out))
    File.write(out, ModelMap::StaticExport.new.render)
    puts "Wrote #{out}"
  end

  desc "List models that have no group or description, so gaps stay visible"
  task gaps: :environment do
    schema = ModelMap::Introspector.new.call
    store = ModelMap::Store.new.read
    missing = schema[:models].select do |m|
      meta = store["models"][m[:name]] || {}
      (meta["group"] || m[:group]).nil? || (meta["description"] || m[:description]).to_s.strip.empty?
    end
    if missing.empty?
      puts "Every model has a group and a description."
    else
      missing.each do |m|
        meta = store["models"][m[:name]] || {}
        gaps = []
        gaps << "group" if (meta["group"] || m[:group]).nil?
        gaps << "description" if (meta["description"] || m[:description]).to_s.strip.empty?
        puts "#{m[:name].ljust(40)} missing #{gaps.join(" and ")}"
      end
      exit 1 if ENV["STRICT"]
    end
  end
end
