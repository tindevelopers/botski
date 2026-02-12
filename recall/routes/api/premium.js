import db from "../../db.js";

/**
 * POST /api/premium/start-trial
 * Activates a 15-day premium trial for the current user.
 */
export async function startTrial(req, res) {
  if (!req.authenticated) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const userId = req.authentication.user.id;

  try {
    const user = await db.User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Already a premium subscriber
    if (user.isPremiumSubscriber) {
      return res.status(400).json({ error: "Already a premium subscriber" });
    }

    // Already has an active trial
    if (user.premiumTrialStartDate) {
      const trialEnd =
        user.premiumTrialEndDate ||
        new Date(user.premiumTrialStartDate.getTime() + 15 * 24 * 60 * 60 * 1000);
      if (new Date() <= trialEnd) {
        return res.status(400).json({
          error: "Trial already active",
          trialEndDate: trialEnd.toISOString(),
        });
      }
      // Trial has expired -- don't allow re-activation
      return res.status(400).json({ error: "Trial has already been used" });
    }

    // Activate trial
    const now = new Date();
    const trialEnd = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

    await user.update({
      premiumTrialStartDate: now,
      premiumTrialEndDate: trialEnd,
    });

    return res.json({
      success: true,
      trialStartDate: now.toISOString(),
      trialEndDate: trialEnd.toISOString(),
    });
  } catch (error) {
    console.error("[api/premium/start-trial] Error:", error);
    return res.status(500).json({ error: "Failed to start trial" });
  }
}

/**
 * POST /api/premium/upgrade
 * Upgrades the current user to premium (stubbed billing — instant toggle).
 */
export async function upgrade(req, res) {
  if (!req.authenticated) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const userId = req.authentication.user.id;

  try {
    const user = await db.User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.isPremiumSubscriber) {
      return res.status(400).json({ error: "Already a premium subscriber" });
    }

    // Stub billing: just flip the flag
    await user.update({ isPremiumSubscriber: true });

    return res.json({
      success: true,
      isPremium: true,
      message: "You have been upgraded to Premium!",
    });
  } catch (error) {
    console.error("[api/premium/upgrade] Error:", error);
    return res.status(500).json({ error: "Failed to upgrade to premium" });
  }
}

/**
 * POST /api/premium/downgrade
 * Downgrades the current user back to the standard plan.
 */
export async function downgrade(req, res) {
  if (!req.authenticated) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const userId = req.authentication.user.id;

  try {
    const user = await db.User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.isPremiumSubscriber) {
      return res.status(400).json({ error: "Not currently a premium subscriber" });
    }

    // Stub billing: just flip the flag back
    await user.update({ isPremiumSubscriber: false });

    return res.json({
      success: true,
      isPremium: false,
      message: "You have been downgraded to the Standard plan.",
    });
  } catch (error) {
    console.error("[api/premium/downgrade] Error:", error);
    return res.status(500).json({ error: "Failed to downgrade" });
  }
}
