import React, { useState } from "react";
import BigToe from "./Big Toe/Big-Toe";
import ChairPose from "./Chair/Chairpose";
import WarriorIII from "./WarriorIII/WarriorIII";

const Yogo = () => {
  const [started, setStarted] = useState(false);

  if (started) return <BigToe />;

  return (
    <div>
      <BigToe />
      <ChairPose />
      <WarriorIII />
    </div>
  );
};

export default Yogo;
