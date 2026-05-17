import eslintPluginAstro from 'eslint-plugin-astro';

const astroConfig = eslintPluginAstro.configs.recommended;
const astroConfigArray = Array.isArray(astroConfig) ? astroConfig : [astroConfig];

export default astroConfigArray;
