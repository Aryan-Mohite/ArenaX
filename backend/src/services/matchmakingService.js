export const matchPlayers = (players) => {
  return players.sort(() => Math.random() - 0.5);
};