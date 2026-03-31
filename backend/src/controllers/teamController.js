import pool from "../config/db.js";

// ─── CREATE TEAM ──────────────────────────────────────────────────────────────
export const createTeam = async (req, res, next) => {
  try {
    const { team_name, region, description } = req.body;
    const userId = req.user.id;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Check name is unique
      const existing = await client.query(
        "SELECT team_id FROM teams WHERE team_name = $1",
        [team_name]
      );
      if (existing.rows.length > 0) {
        await client.query("ROLLBACK");
        return res.status(409).json({ success: false, message: "Team name already taken" });
      }

      const teamResult = await client.query(
        `INSERT INTO teams (team_name, region, description, created_by)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [team_name, region, description, userId]
      );
      const team = teamResult.rows[0];

      // Creator is automatically added as a member
      await client.query(
        `INSERT INTO team_members (team_id, user_id, role, status)
         VALUES ($1, $2, 'captain', 'active')`,
        [team.team_id, userId]
      );

      await client.query("COMMIT");
      res.status(201).json({ success: true, team });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
};

// ─── GET TEAM ─────────────────────────────────────────────────────────────────
export const getTeam = async (req, res, next) => {
  try {
    const { id } = req.params;

    const teamResult = await pool.query(
      "SELECT * FROM teams WHERE team_id = $1",
      [id]
    );
    if (teamResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Team not found" });
    }

    const membersResult = await pool.query(
      `SELECT tm.role, tm.joined_at, tm.status,
              u.user_id, u.username, u.profile_picture, u.country
       FROM team_members tm
       JOIN users u ON u.user_id = tm.user_id
       WHERE tm.team_id = $1 AND tm.status = 'active'
       ORDER BY tm.joined_at ASC`,
      [id]
    );

    res.json({
      success: true,
      team: { ...teamResult.rows[0], members: membersResult.rows },
    });
  } catch (err) {
    next(err);
  }
};

// ─── INVITE MEMBER ────────────────────────────────────────────────────────────
export const inviteMember = async (req, res, next) => {
  try {
    const { id: team_id } = req.params;
    const { user_id } = req.body;
    const inviterId = req.user.id;

    // Only team captain can invite
    const captainCheck = await pool.query(
      "SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2 AND role = 'captain' AND status = 'active'",
      [team_id, inviterId]
    );
    if (captainCheck.rows.length === 0) {
      return res.status(403).json({ success: false, message: "Only the team captain can invite members" });
    }

    // Check if already a member
    const alreadyMember = await pool.query(
      "SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2 AND status = 'active'",
      [team_id, user_id]
    );
    if (alreadyMember.rows.length > 0) {
      return res.status(409).json({ success: false, message: "User is already a team member" });
    }

    // Check for pending invite
    const pendingInvite = await pool.query(
      "SELECT * FROM team_invitations WHERE team_id = $1 AND user_id = $2 AND status = 'pending'",
      [team_id, user_id]
    );
    if (pendingInvite.rows.length > 0) {
      return res.status(409).json({ success: false, message: "Invitation already sent" });
    }

    const result = await pool.query(
      `INSERT INTO team_invitations (team_id, user_id, invited_by, status)
       VALUES ($1, $2, $3, 'pending') RETURNING *`,
      [team_id, user_id, inviterId]
    );

    res.status(201).json({ success: true, invitation: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// ─── RESPOND TO INVITATION ────────────────────────────────────────────────────
export const respondToInvitation = async (req, res, next) => {
  try {
    const { invite_id } = req.params;
    const { action } = req.body; // 'accept' or 'decline'
    const userId = req.user.id;

    if (!["accept", "decline"].includes(action)) {
      return res.status(400).json({ success: false, message: "action must be 'accept' or 'decline'" });
    }

    const invite = await pool.query(
      "SELECT * FROM team_invitations WHERE invite_id = $1 AND user_id = $2 AND status = 'pending'",
      [invite_id, userId]
    );
    if (invite.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Invitation not found" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        "UPDATE team_invitations SET status = $1 WHERE invite_id = $2",
        [action === "accept" ? "accepted" : "declined", invite_id]
      );

      if (action === "accept") {
        await client.query(
          `INSERT INTO team_members (team_id, user_id, role, status)
           VALUES ($1, $2, 'member', 'active')
           ON CONFLICT (team_id, user_id) DO UPDATE SET status = 'active'`,
          [invite.rows[0].team_id, userId]
        );
      }

      await client.query("COMMIT");
      res.json({ success: true, message: `Invitation ${action}ed` });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
};

// ─── LEAVE TEAM ───────────────────────────────────────────────────────────────
export const leaveTeam = async (req, res, next) => {
  try {
    const { id: team_id } = req.params;
    const userId = req.user.id;

    const membership = await pool.query(
      "SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2 AND status = 'active'",
      [team_id, userId]
    );
    if (membership.rows.length === 0) {
      return res.status(404).json({ success: false, message: "You are not in this team" });
    }
    if (membership.rows[0].role === "captain") {
      return res.status(400).json({
        success: false,
        message: "Captain cannot leave. Transfer captain role first or disband the team.",
      });
    }

    await pool.query(
      "UPDATE team_members SET status = 'inactive' WHERE team_id = $1 AND user_id = $2",
      [team_id, userId]
    );

    res.json({ success: true, message: "Left team successfully" });
  } catch (err) {
    next(err);
  }
};
