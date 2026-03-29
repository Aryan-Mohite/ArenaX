import { useEffect, useState } from "react";
import { getUsers } from "../services/userService";

export default function Users() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    const res = await getUsers();
    setUsers(res.data);
  };

  return (
    <div>
      {users.map((u) => (
        <p key={u.user_id}>{u.username}</p>
      ))}
    </div>
  );
}