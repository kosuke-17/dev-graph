import React from "react";

export const Card = ({ children }: { children: React.ReactNode }) => {
  return (
    <div style={{ border: "1px solid #000", padding: "10px" }}>{children}</div>
  );
};
