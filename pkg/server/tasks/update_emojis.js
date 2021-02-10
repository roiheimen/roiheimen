module.exports = async (payload, helpers) => {
  const { emojis } = payload;
  helpers.logger.info(`Got emojis, ${JSON.stringify(emojis)} !!`);
  await helpers.withPgClient((pgClient) => pgClient.query(`insert into roiheimen.log (type, data) values ('emoji', '${JSON.stringify(emojis)}');`));
  helpers.logger.info(`Wrote.`);
};
