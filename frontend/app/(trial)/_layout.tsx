import { Slot } from "expo-router";
import { useEffect } from "react";
import { loadDefaultQuestionSets } from "../../src/data/defaultQuestionSets";

export default function TrialLayout() {
  useEffect(() => {
    loadDefaultQuestionSets();
  }, []);

  return <Slot />;
}
