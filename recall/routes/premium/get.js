import db from "../../db.js";

export default async (req, res) => {
  if (!req.authenticated) {
    return res.redirect("/sign-in");
  }

  const userId = req.authentication.user.id;
  const user = await db.User.findByPk(userId);

  const isPremium = user?.isPremiumSubscriber || false;
  const isTrial = user?.isPremiumOrTrial() && !isPremium;

  let trialEndDate = null;
  if (user?.premiumTrialStartDate) {
    trialEndDate =
      user.premiumTrialEndDate ||
      new Date(user.premiumTrialStartDate.getTime() + 15 * 24 * 60 * 60 * 1000);
  }

  return res.render("premium.ejs", {
    notice: req.notice || null,
    user: req.authentication.user,
    isPremium,
    isTrial,
    trialEndDate,
  });
};
