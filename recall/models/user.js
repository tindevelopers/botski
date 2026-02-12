import { DataTypes } from "sequelize";

export default (sequelize) => {
  const User = sequelize.define(
    "User",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      premiumTrialStartDate: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
        field: "premium_trial_start_date",
      },
      premiumTrialEndDate: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
        field: "premium_trial_end_date",
      },
      isPremiumSubscriber: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: "is_premium_subscriber",
      },
    },
    {
      sequelize,
      tableName: "users",
      modelName: "User",
    }
  );

  /**
   * Returns true if the user has an active premium subscription or
   * is within their 15-day trial period.
   */
  User.prototype.isPremiumOrTrial = function () {
    if (this.isPremiumSubscriber) return true;
    if (!this.premiumTrialStartDate) return false;
    const trialEnd =
      this.premiumTrialEndDate ||
      new Date(this.premiumTrialStartDate.getTime() + 15 * 24 * 60 * 60 * 1000);
    return new Date() <= trialEnd;
  };

  return User;
};
