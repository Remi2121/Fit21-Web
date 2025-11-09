module.exports = function override(config, env) {
  // Locate existing source-map-loader rule
  const sourceMapRule = config.module.rules.find(rule =>
    rule.oneOf
  );

  if (sourceMapRule) {
    sourceMapRule.oneOf = sourceMapRule.oneOf.map(rule => {
      if (
        rule.use &&
        rule.use.some(u => u.loader && u.loader.includes("source-map-loader"))
      ) {
        // Exclude mediapipe folder
        return {
          ...rule,
          exclude: [
            ...(rule.exclude || []),
            /node_modules\/@mediapipe\/tasks-vision/,
          ],
        };
      }
      return rule;
    });
  }

  return config;
};
