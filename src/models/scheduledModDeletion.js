'use strict';
module.exports = sequelize => {
  var types = sequelize.Sequelize;
  var ScheduledModDeletion = sequelize.define('scheduled-mod-deletion', {
    modId: {
      type: types.STRING,
      unique: true,
      allowNull: false,
      references: {
        model: 'mods',
        key: 'id',
      },
    },
    deletionTime: {
      type: types.DATE,
    },
  });
  return ScheduledModDeletion;
};
