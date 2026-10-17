const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withPodDeploymentTargetFix(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let podfile = fs.readFileSync(podfilePath, 'utf8');
      const marker = "IPHONEOS_DEPLOYMENT_TARGET'] = '16.4'";
      if (!podfile.includes(marker)) {
        const injectCode = `    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |cfg|
        cfg.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '16.4'
        if target.name == 'RevenueCat'
          cfg.build_settings['SWIFT_VERSION'] = '5.0'
        end
      end
    end
`;
        podfile = podfile.replace(
          /post_install do \|installer\|/,
          'post_install do |installer|\n' + injectCode
        );
        fs.writeFileSync(podfilePath, podfile);
      }
      return config;
    },
  ]);
};
