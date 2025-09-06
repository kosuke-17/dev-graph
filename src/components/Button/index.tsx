import React from "react";

export const Button = () => {
  return (
    <button
      onClick={() => {
        console.log("Button clicked");
      }}
    >
      Button
    </button>
  );
};
