import { StreetGuessGame } from "@/components/street-guess-game";
import { getStarterCluesData } from "@/lib/clues/repository";

export default async function Home() {
  const starterClues = await getStarterCluesData(3);

  return <StreetGuessGame starterClues={starterClues} />;
}
