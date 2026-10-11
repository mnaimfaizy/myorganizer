Pod::Spec.new do |s|
  s.name         = "KeyboardFocusEvents"
  s.version      = "1.0.0"
  s.summary      = "Tells a React Native view on iOS when a hardware keyboard gives it focus."
  s.homepage     = "https://github.com/mnaimfaizy/myorganizer"
  s.license      = "UNLICENSED"
  s.author       = { "MyOrganizer" => "noreply@myorganizer.invalid" }
  s.platforms    = { :ios => "15.1" }
  s.source       = { :path => "." }
  s.source_files = "*.{h,mm}"
  s.public_header_files = "KeyboardFocusEvents.h"
  # A module, so AppDelegate.swift can import the one Objective-C header.
  s.pod_target_xcconfig = { "DEFINES_MODULE" => "YES" }
  # The Fabric headers `RCTViewComponentView.h` pulls in, and their C++ flags.
  install_modules_dependencies(s)
end
