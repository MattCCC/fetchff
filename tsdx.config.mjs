import { bundleImports } from 'rollup-plugin-bundle-imports'

module.exports = {
    // This function will run for each entry/format/env combination
    rollup(config, options) {
        config.plugins.push(
            bundleImports()
        );

        return config;
    },
};
