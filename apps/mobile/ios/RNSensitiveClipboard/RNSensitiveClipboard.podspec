Pod::Spec.new do |s|
  s.name         = "RNSensitiveClipboard"
  s.version      = "1.0.0"
  s.summary      = "Local-only, expiring clipboard copy for the Details slice's Sensitive Clipboard."
  s.homepage     = "https://github.com/mnaimfaizy/myorganizer"
  s.license      = "UNLICENSED"
  s.author       = { "MyOrganizer" => "noreply@myorganizer.invalid" }
  s.platforms    = { :ios => "15.1" }
  s.source       = { :path => "." }
  s.source_files = "*.{h,m,swift}"
  s.dependency "React-Core"
end
