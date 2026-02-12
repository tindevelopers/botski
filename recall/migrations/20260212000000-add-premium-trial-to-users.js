"use strict";

import { Sequelize } from "sequelize";

export const up = async ({ context: { queryInterface } }) => {
  await queryInterface.addColumn("users", "premium_trial_start_date", {
    type: Sequelize.DATE,
    allowNull: true,
    defaultValue: null,
  });

  await queryInterface.addColumn("users", "premium_trial_end_date", {
    type: Sequelize.DATE,
    allowNull: true,
    defaultValue: null,
  });

  await queryInterface.addColumn("users", "is_premium_subscriber", {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  });
};

export const down = async ({ context: { queryInterface } }) => {
  await queryInterface.removeColumn("users", "premium_trial_start_date");
  await queryInterface.removeColumn("users", "premium_trial_end_date");
  await queryInterface.removeColumn("users", "is_premium_subscriber");
};
