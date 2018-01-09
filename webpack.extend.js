const webpack = require("webpack");
const package = require("./package.json");
module.exports = function(config) {
    config.devtool = "eval";
    config.plugins = config.plugins || [];
    config.plugins.push(new webpack.DefinePlugin({
        BUILD_VERSION: JSON.stringify(package.version),
    }));
    return config;
}