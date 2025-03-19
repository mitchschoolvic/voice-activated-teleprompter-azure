import { useEffect, useRef, useLayoutEffect } from "react";
import { escape } from "html-escaper";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import {
  setContent,
  setFinalTranscriptIndex,
  setInterimTranscriptIndex,
  PLACEHOLDER_TEXT,
  selectRawText,
  selectTextElements,
  selectFinalTranscriptIndex,
  selectInterimTranscriptIndex,
} from "./contentSlice";
import { selectSavedPosition, setSavedPosition } from "../scroll/scrollSlice";
import {
  selectStatus,
  selectHorizontallyFlipped,
  selectVerticallyFlipped,
  selectFontSize,
  selectMargin,
  selectOpacity,
  selectReadLinePosition,
} from "../navbar/navbarSlice";

interface Padding {
  top: number;
  bottom: number;
}

// Easing function for smooth acceleration/deceleration
const easeInOutQuad = (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);

// Custom smooth scroll function using requestAnimationFrame
const smoothScroll = (element: HTMLElement, to: number, duration: number) => {
  const start = element.scrollTop;
  const change = to - start;
  const startTime = performance.now();

  const animateScroll = (currentTime: number) => {
    const timeElapsed = currentTime - startTime;
    const progress = Math.min(timeElapsed / duration, 1); // Clamp between 0 and 1
    const easedProgress = easeInOutQuad(progress);
    element.scrollTop = start + change * easedProgress;

    if (timeElapsed < duration) {
      requestAnimationFrame(animateScroll);
    }
  };

  requestAnimationFrame(animateScroll);
};

export const Content = () => {
  const dispatch = useAppDispatch();

  const status = useAppSelector(selectStatus);
  const fontSize = useAppSelector(selectFontSize);
  const margin = useAppSelector(selectMargin);
  const opacity = useAppSelector(selectOpacity);
  const readLinePosition = useAppSelector(selectReadLinePosition);
  const horizontallyFlipped = useAppSelector(selectHorizontallyFlipped);
  const verticallyFlipped = useAppSelector(selectVerticallyFlipped);
  const rawText = useAppSelector(selectRawText);
  const textElements = useAppSelector(selectTextElements);
  const finalTranscriptIndex = useAppSelector(selectFinalTranscriptIndex);
  const interimTranscriptIndex = useAppSelector(selectInterimTranscriptIndex);
  const savedPosition = useAppSelector(selectSavedPosition);

  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastRef = useRef<HTMLDivElement>(null);
  const lastInterimIndex = useRef<number>(-1);
  const prevFontSizeRef = useRef(fontSize);
  const prevReadLineRef = useRef(readLinePosition);
  const isInitializedRef = useRef(false);
  const prevStatusRef = useRef(status);
  const wasAtTopRef = useRef(true);

  const calculatePadding = (containerHeight: number): Padding => {
    if (status === "editorMode") {
      const topPadding = containerHeight * 0.1;
      return {
        top: topPadding,
        bottom: containerHeight * 0.1,
      };
    }

    const readLinePixels = containerHeight * (readLinePosition / 100);
    return {
      top: containerHeight * 0.1,
      bottom: readLinePixels,
    };
  };

  const getStyles = () => {
    const baseStyles = {
      fontSize: `${fontSize}px`,
      paddingLeft: `${margin}px`,
      paddingRight: `${margin}px`,
    };

    if (status === "editing" || status === "editorMode") {
      return baseStyles;
    }

    return {
      ...baseStyles,
      opacity: opacity / 100,
      transform: `scale(${horizontallyFlipped ? "-1" : "1"}, ${
        verticallyFlipped ? "-1" : "1"
      })`,
    };
  };

  useEffect(() => {
    const currentElement =
      status === "editing" || status === "editorMode"
        ? textareaRef.current
        : containerRef.current;

    if (currentElement) {
      const containerHeight = currentElement.clientHeight;
      const { top, bottom } = calculatePadding(containerHeight);

      currentElement.style.paddingTop = `${top}px`;
      currentElement.style.paddingBottom = `${bottom}px`;
    }
  }, []);

  useLayoutEffect(() => {
    if (!isInitializedRef.current) {
      const currentElement =
        status === "editing" || status === "editorMode"
          ? textareaRef.current
          : containerRef.current;

      if (currentElement) {
        wasAtTopRef.current = currentElement.scrollTop === 0;
        isInitializedRef.current = true;
      }
    }
  }, [status]);

  useEffect(() => {
    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement;
      const scrollTop = target.scrollTop;
      dispatch(setSavedPosition(scrollTop));
      wasAtTopRef.current = scrollTop === 0;
    };

    const currentElement =
      status === "editing" || status === "editorMode"
        ? textareaRef.current
        : containerRef.current;

    currentElement?.addEventListener("scroll", handleScroll);

    return () => {
      currentElement?.removeEventListener("scroll", handleScroll);
    };
  }, [status, dispatch]);

  useEffect(() => {
    if (status !== prevStatusRef.current) {
      const currentElement =
        status === "editing" || status === "editorMode"
          ? textareaRef.current
          : containerRef.current;

      if (currentElement) {
        const containerHeight = currentElement.clientHeight;
        const { top, bottom } = calculatePadding(containerHeight);
        const isLeavingEditorMode =
          prevStatusRef.current === "editorMode" && status !== "editorMode";

        currentElement.style.paddingTop = `${top}px`;
        currentElement.style.paddingBottom = `${bottom}px`;

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (isLeavingEditorMode && wasAtTopRef.current) {
              currentElement.scrollTop = 0;
            } else if (savedPosition > 0) {
              currentElement.scrollTop = savedPosition;
            }
          });
        });
      }

      prevStatusRef.current = status;
    }
  }, [status, savedPosition, readLinePosition]);

  useEffect(() => {
    if (prevReadLineRef.current !== readLinePosition) {
      const currentElement =
        status === "editing" || status === "editorMode"
          ? textareaRef.current
          : containerRef.current;

      if (currentElement) {
        const containerHeight = currentElement.clientHeight;
        const { top, bottom } = calculatePadding(containerHeight);

        currentElement.style.paddingTop = `${top}px`;
        currentElement.style.paddingBottom = `${bottom}px`;

        const currentScrollTop = currentElement.scrollTop;
        const currentReadLinePosition =
          containerHeight * (prevReadLineRef.current / 100);
        const newReadLinePosition =
          containerHeight * (readLinePosition / 100);
        const scrollAdjustment =
          newReadLinePosition - currentReadLinePosition;

        currentElement.scrollTo({
          top: currentScrollTop + scrollAdjustment,
          behavior: "smooth",
        });

        prevReadLineRef.current = readLinePosition;
      }
    }
  }, [readLinePosition, status]);

  useEffect(() => {
    if (status === "started" && containerRef.current && lastRef.current) {
      if (interimTranscriptIndex !== lastInterimIndex.current) {
        const container = containerRef.current;
        const containerHeight = container.clientHeight;
        const readLineOffset = containerHeight * ((100 - readLinePosition) / 100);
        const targetPosition = lastRef.current.offsetTop - readLineOffset;

        const { bottom } = calculatePadding(containerHeight);
        container.style.paddingBottom = `${bottom}px`;

        // Use custom smoothScroll instead of native scrollTo
        smoothScroll(container, targetPosition, 300); // 300ms duration

        lastInterimIndex.current = interimTranscriptIndex;
      }
    }
  }, [interimTranscriptIndex, readLinePosition, status]);

  return (
    <main className="content-area">
      {(status === "editing" || status === "editorMode") ? (
        <textarea
          ref={textareaRef}
          className={`content ${status === "editorMode" ? "editor-mode" : ""}`}
          style={getStyles()}
          value={rawText}
          onChange={(e) => dispatch(setContent(e.target.value))}
          placeholder={PLACEHOLDER_TEXT}
          spellCheck={false}
        />
      ) : (
        <div className="content" ref={containerRef} style={getStyles()}>
          {rawText ? (
            textElements.map((textElement, index, array) => {
              const itemProps =
                interimTranscriptIndex > 0 &&
                index === Math.min(interimTranscriptIndex + 2, array.length - 1)
                  ? { ref: lastRef }
                  : {};

              return (
                <span
                  key={textElement.index}
                  onClick={() => {
                    void dispatch(setFinalTranscriptIndex(index));
                    void dispatch(setInterimTranscriptIndex(index));
                  }}
                  className={
                    finalTranscriptIndex > 0 &&
                    textElement.index < finalTranscriptIndex
                      ? "final-transcript"
                      : interimTranscriptIndex > 0 &&
                        textElement.index <= interimTranscriptIndex + 1
                      ? "interim-transcript"
                      : "has-text-white"
                  }
                  {...itemProps}
                  dangerouslySetInnerHTML={{
                    __html: escape(textElement.value).replace(/\n/g, "<br>"),
                  }}
                />
              );
            })
          ) : (
            <div className="placeholder-text">{PLACEHOLDER_TEXT}</div>
          )}
        </div>
      )}
    </main>
  );
};