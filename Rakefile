require "rake/testtask"

Rake::TestTask.new(:test) do |t|
  t.libs << "lib" << "test"
  t.pattern = "test/**/*_test.rb"
  t.warning = false
end

desc "Build the React frontend into dist/"
task :build_frontend do
  sh "bin/build-frontend"
end

task default: :test
