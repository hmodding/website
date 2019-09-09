'use strict';
module.exports = sequelize => {
  const types = sequelize.Sequelize;
  return sequelize.define('scheduled-plugin-deletions', {
    pluginId: {
      type: types.INTEGER,
      unique: true,
      allowNull: false,
      references: {
        model: 'plugins',
        key: 'id',
      },
    },
    deletionTime: {
      type: types.DATE,
    },
  });
};
