Pod::Spec.new do |s|
  s.name         = "RNKeepAwake"
  s.version      = "1.0.0"
  s.summary      = "Keeps the screen on while a Grocery List is open on a trip."
  s.homepage     = "https://github.com/mnaimfaizy/myorganiser"
  s.license      = "UNLICENSED"
  s.author       = { "MyOrganiser" => "noreply@myorganiser.invalid" }
  s.platforms    = { :ios => "15.1" }
  s.source       = { :path => "." }
  s.source_files = "*.{h,m,swift}"
  s.dependency "React-Core"
end
