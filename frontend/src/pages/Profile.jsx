import { useEffect, useState } from "react";
import { getProfile, updateProfile } from "../services/userService";
import "../styles/Profile.css";

export default function Profile() {
  const [profile, setProfile] = useState({});
  const [editMode, setEditMode] = useState(false);

  const userId = localStorage.getItem("userId");

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const res = await getProfile(userId);
    setProfile(res.data);
  };

  const handleChange = (e) => {
    setProfile({ ...profile, [e.target.name]: e.target.value });
  };

  const saveProfile = async () => {
    await updateProfile(userId, profile);
    setEditMode(false);
  };

  return (
    <div className="profile-container">
      <div className="profile-card">
        <div className="profile-header">
          <img
            src={profile.profile_photo || "/default-avatar.png"}
            alt="profile"
            className="profile-img"
          />

          <h2>{profile.username}</h2>

          <p className="rank">Rank: {profile.rank}</p>
        </div>

        <div className="profile-body">
          <div className="info-box">
            <label>Email</label>
            <p>{profile.email}</p>
          </div>

          <div className="info-box">
            <label>Rating</label>
            <p>{profile.rating}</p>
          </div>

          <div className="info-box">
            <label>Favourite Games</label>

            {editMode ? (
              <input
                name="fav_games"
                value={profile.fav_games || ""}
                onChange={handleChange}
              />
            ) : (
              <p>{profile.fav_games}</p>
            )}
          </div>

          <div className="info-box">
            <label>Bio</label>

            {editMode ? (
              <textarea
                name="bio"
                value={profile.bio || ""}
                onChange={handleChange}
              />
            ) : (
              <p>{profile.bio}</p>
            )}
          </div>
        </div>

        <div className="profile-actions">
          {editMode ? (
            <button onClick={saveProfile}>Save</button>
          ) : (
            <button onClick={() => setEditMode(true)}>Edit Profile</button>
          )}
        </div>
      </div>
    </div>
  );
}
