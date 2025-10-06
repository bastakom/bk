"use client";

import { useState, useRef } from "react";
import { render } from "storyblok-rich-text-react-renderer";

interface ExpandableContentProps {
  content: any;
}

const ExpandableContent = ({
  content,
}: ExpandableContentProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const contentTopRef = useRef<HTMLDivElement>(null);

  const handleToggle = () => {
    if (isExpanded) {
      if (contentTopRef.current) {
        const elementTop = contentTopRef.current.offsetTop;
        const viewportHeight = window.innerHeight;
        const paddingAbove = Math.min(
          400,
          viewportHeight * 0.4
        );
        const targetScrollPosition =
          elementTop - paddingAbove;

        window.scrollTo({
          top: Math.max(0, targetScrollPosition),
          behavior: "smooth",
        });
      }
    }
    setIsExpanded(!isExpanded);
  };

  return (
    <span
      ref={contentTopRef}
      className="lg:max-w-[70%] mx-auto xl:max-w-[1400px] px-8 render-text"
    >
      <span className="lg:max-w-[50%] max-w-[100%] mx-auto block">
        <div />
        <div
          className={`overflow-hidden transition-all duration-500 relative ${
            isExpanded ? "max-h-full" : "max-h-[200px]"
          }`}
        >
          {render(content)}
          {!isExpanded && (
            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white to-transparent pointer-events-none"></div>
          )}
        </div>
        <div className="text-center mt-2">
          <button
            onClick={handleToggle}
            className="underline"
          >
            {isExpanded ? "Läs mindre" : "Läs mer"}
          </button>
        </div>
      </span>
    </span>
  );
};

export default ExpandableContent;
