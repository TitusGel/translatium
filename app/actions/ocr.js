/* global fetch FormData URL */
import { push } from 'react-router-redux';
import Immutable from 'immutable';

import { UPDATE_OCR } from '../constants/actions';

import translateArray from '../libs/translateArray';
import openFileToBlob from '../libs/openFileToBlob';
import captureToBlob from '../libs/captureToBlob';
import { toOcrSpaceLanguage } from '../libs/languageUtils';
import { openAlert } from './alert';

export const loadImage = fromCamera => (dispatch, getState) => {
  const { inputLang, outputLang } = getState().settings;

  Promise.resolve()
    .then(() => {
      if (fromCamera === true) return captureToBlob();
      return openFileToBlob();
    })
    .then((result) => {
      if (!result) return;

      const { blob, fileName } = result;

      dispatch({
        type: UPDATE_OCR,
        ocr: Immutable.fromJS({ status: 'loading' }),
      });

      const formData = new FormData();
      formData.append('apikey', '0088228ab088957');
      formData.append('file', blob, fileName);
      formData.append('language', toOcrSpaceLanguage(inputLang));
      formData.append('isOverlayRequired', true);

      fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        body: formData,
      })
      .then(response => response.json())
      .then(({ ParsedResults }) => {
        if (ParsedResults[0].FileParseExitCode !== 1) {
          dispatch({
            type: UPDATE_OCR,
            ocr: null,
          });

          dispatch(openAlert('cannotRecognizeImage'));
        }

        const inputText = ParsedResults[0].ParsedText;
        const inputLines = ParsedResults[0].TextOverlay.Lines.map((line) => {
          let lineText = '';

          line.Words.forEach((word) => { lineText += ` ${word.WordText}`; });

          return {
            height: line.MaxHeight,
            top: line.MinTop,
            left: line.Words[0].Left,
            text: lineText,
          };
        });

        const inputArr = inputLines.map(line => line.text);

        return translateArray(inputLang, outputLang, inputArr)
          .then(({ outputArr, outputText }) => {
            const outputLines = outputArr.map((text, i) => ({
              height: inputLines[i].height,
              top: inputLines[i].top,
              left: inputLines[i].left,
              text,
            }));

            dispatch({
              type: UPDATE_OCR,
              ocr: Immutable.fromJS({
                status: 'done',
                imageUrl: URL.createObjectURL(blob, { oneTimeOnly: true }),
                inputText,
                inputLines,
                outputText,
                outputLines,
              }),
            });


            dispatch(push('/ocr'));
          });
      })
      .catch(() => {
        dispatch({
          type: UPDATE_OCR,
          ocr: null,
        });

        dispatch(openAlert('cannotConnectToServer'));
      });
    })
    .catch(() => {
      dispatch(openAlert('cannotOpenTheFile'));
    });
};

export const setZoomLevel = zoomLevel => (dispatch, getState) => {
  const ocr = getState().ocr;
  dispatch({
    type: UPDATE_OCR,
    ocr: ocr.set('zoomLevel', zoomLevel),
  });
};

export const setMode = mode => (dispatch, getState) => {
  const ocr = getState().ocr;
  dispatch({
    type: UPDATE_OCR,
    ocr: ocr.set('mode', mode),
  });
};
