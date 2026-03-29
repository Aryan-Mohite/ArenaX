
import { useEffect, useState } from "react";
import { getTournaments } from "../services/tournamentService";

export default function Tournaments() {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetchTournaments();
  }, []);

  const fetchTournaments = async () => {
    const res = await getTournaments();
    setData(res.data);
  };

  return (
    <div>
      <h1>Tournaments</h1>

      {data.map((t) => (
        <div key={t.tournament_id}>
          <h3>{t.name}</h3>
        </div>
      ))}
    </div>
  );
}
