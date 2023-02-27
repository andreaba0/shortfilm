const path = require('path');

module.exports = {
    mode: 'development',
    entry: './src/index.js',
    externals: {
        'EditorJSCDN': 'EditorJS',
        'EditorJSHeader': 'Header'
    },
    output: {
        filename: 'main.js',
        path: path.resolve(__dirname, 'dist'),
    },
    module: {
        rules: [
            {
                test: /\.css$/i,
                include: path.resolve(__dirname, 'src'),
                use: ['style-loader', 'css-loader', 'postcss-loader'],
            },
            {
                test: /\.m?js$/,
                exclude: /(node_modules)/,
                use: {
                    // `.swcrc` can be used to configure swc
                    loader: "swc-loader"
                }
            },
        ],
    },
};