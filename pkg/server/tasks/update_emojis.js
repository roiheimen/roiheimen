module.exports = async (payload, helpers) => {
  const { emojis } = payload;
  helpers.logger.info(`Got emojis, ${JSON.stringify(emojis)} !!`);
};
