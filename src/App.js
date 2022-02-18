import React, { useEffect, useRef, useState } from "react";
import * as mobilenet from "@tensorflow-models/mobilenet";
import { initNotifications, notify } from "@mycv/f8-notification";
import * as knnClassifier from "@tensorflow-models/knn-classifier";
import * as tf from "@tensorflow/tfjs";
// fix error uncaught backend in registry
import { Howl } from "howler";
import soundURL from "./assets/warnsound.mp3";
import "./App.css";

var sound = new Howl({
  src: [soundURL],
});

const NOT_TOUCH_LABEL = "not_touch";
const TOUCHED_LABEl = "touched";
const TRAINING_TIME = 50;
const LEARNING_TIME = 5000;
const TOUCHED_CONFIDENCE = 0.8;

function App() {
  const video = useRef();
  const classifier = useRef();
  const canPlaySound = useRef();
  canPlaySound.current = true;
  const mobilenetModule = useRef();
  const [touched, setTouched] = useState(false);
  // handle disable button
  const [isDisabled1, setDisabled1] = useState(false);
  const [isDisabled2, setDisabled2] = useState(true);
  const [isDisabledRun, setDisabledRun] = useState(true);

  // initial function
  const init = async () => {
    await setupCamera();
    // wait for setup camera
    classifier.current = knnClassifier.create();
    mobilenetModule.current = await mobilenet.load();
    console.log("setup done");
    // init notification permission
    // after 3s => request notification
    initNotifications({ cooldown: 3000 });
  };

  const setupCamera = () => {
    return new Promise((resolve, reject) => {
      navigator.getUserMedia =
        navigator.getUserMedia ||
        navigator.webkitGetUserMedia ||
        navigator.mozGetUserMedia ||
        navigator.msGetUserMedia;

      if (navigator.getUserMedia) {
        navigator.getUserMedia(
          { video: true },
          (stream) => {
            video.current.srcObject = stream;
            video.current.addEventListener("loadeddata", resolve);
          },
          (error) => reject(error)
        );
      } else {
        console.log("Cannot find camera");
        reject();
      }
    });
  };
  const train = async (label) => {
    // loop for training
    for (let i = 0; i < TRAINING_TIME; i++) {
      console.log(`progress ${((i + 1) * 100) / TRAINING_TIME}%`);
      await training(label);
    }
    if (label === NOT_TOUCH_LABEL) {
      setDisabled2(false);
      setDisabled1(true);
      console.log("finished train1");
    }
    if (label === TOUCHED_LABEl) {
      setDisabled2(true);
      setDisabledRun(false);
    }
  };
  const training = (label) => {
    return new Promise(async (resolve) => {
      const embedding = mobilenetModule.current.infer(video.current, true);
      classifier.current.addExample(embedding, label);
      await sleep(LEARNING_TIME / TRAINING_TIME);

      resolve();
    });
  };

  const run = async () => {
    const embedding = mobilenetModule.current.infer(video.current, true);
    const result = await classifier.current.predictClass(embedding);
    console.log(result);
    if (
      result.label === TOUCHED_LABEl &&
      result.confidences[result.label] > TOUCHED_CONFIDENCE
    ) {
      console.log("touched");
      if (canPlaySound.current) {
        canPlaySound.current = false;
        sound.play();
      }
      notify("Touched", { body: "Hand down" });
      setTouched(true);
    } else {
      console.log("not_touch");
      setTouched(false);
    }
    await sleep(1000);
    run();
  };

  // synchronous handle
  const sleep = (ms = 0) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
  };

  // Call init() at beginning
  useEffect(() => {
    init();
    console.log("init called");
    sound.on("end", function () {
      canPlaySound.current = true;
    });
    // clean up function
    return () => {};
  }, []);

  return (
    <div className="main">
      <video
        className={`main ${touched ? "touched" : ""}`}
        autoPlay
        ref={video}
      />
      <div className="control">
        <button
          disabled={isDisabled1}
          className="btn"
          onClick={() => {
            train(NOT_TOUCH_LABEL);
          }}
        >
          Train 1
        </button>
        <button
          className="btn"
          disabled={isDisabled2}
          onClick={() => {
            train(TOUCHED_LABEl);
          }}
        >
          Train 2
        </button>
        <button
          className="btn"
          disabled={isDisabledRun}
          onClick={() => {
            run();
          }}
        >
          Run
        </button>
      </div>
    </div>
  );
}

export default App;
