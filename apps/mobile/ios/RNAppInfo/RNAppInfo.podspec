Pod::Spec.new do |s|
  s.name         = "RNAppInfo"
  s.version      = "1.0.0"
  s.summary      = "The app's bundle version and build, for Account's About row."
  s.homepage     = "https://github.com/mnaimfaizy/myorganizer"
  s.license      = "UNLICENSED"
  s.author       = { "MyOrganizer" => "noreply@myorganizer.invalid" }
  s.platforms    = { :ios => "15.1" }
  s.source       = { :path => "." }
  s.source_files = "*.{h,m,swift}"
  s.dependency "React-Core"
end
