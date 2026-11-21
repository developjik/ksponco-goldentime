import { Link } from 'react-router-dom';
import { TOTAL_CAPACITY, TOTAL_CAPACITY_SOURCE } from '../lib/congestion';

export default function Guide() {
  return (
    <section>
      <h1>이용안내</h1>

      <h2>골든타임이란?</h2>
      <p>
        올림픽공원 주차장이 꽉 차기 전, 혼잡이 가장 낮아 여유롭게 입장할 수 있는 시간대를
        뜻합니다. 이 서비스는 실시간 혼잡을 먼저 보여 주고, 앞으로 그 시간대를 예측해
        알려 주는 것을 목표로 합니다.
      </p>

      <h2>데이터 출처</h2>
      <ul>
        <li>
          <strong>실시간 전체 주차대수</strong> — 한국체육산업개발(주) 「올림픽공원 실시간
          주차현황」 공개 API(ksponco.or.kr). 브라우저에서 직접 조회합니다.
        </li>
        <li>
          <strong>전체 수용 능력 약 {TOTAL_CAPACITY.toLocaleString('ko-KR')}대</strong> —{' '}
          <a
            href={TOTAL_CAPACITY_SOURCE.url}
            target="_blank"
            rel="noreferrer noopener"
          >
            {TOTAL_CAPACITY_SOURCE.label}
          </a>
          . 재차율(%)은 이 값을 기준으로 계산합니다.
        </li>
        <li>
          <strong>예측·히트맵(준비 중)</strong> — 공공데이터포털 「한국체육산업개발주식회사_실시간
          주차현황」 데이터 활용 신청 중. 승인 후{' '}
          <Link to="/predict">예측 섹션</Link>이 채워집니다.
        </li>
      </ul>

      <h2>데이터 갱신 주기</h2>
      <ul>
        <li>실시간 주차대수: 1분(60초)마다 자동 갱신, `지금 새로고침` 버튼으로 즉시 갱신.</li>
        <li>
          세션 내 추이: 방문 중 수집한 측정값만 표시. 페이지를 새로고침하면 다시 시작됩니다.
        </li>
        <li>
          네트워크 오류 등으로 갱신에 실패하면 마지막 성공 값을 표시하고 오류 안내와 재시도
          버튼을 보여 줍니다.
        </li>
      </ul>

      <h2>혼잡 단계 기준(자체 기준)</h2>
      <p>재차율 구간에 따른 단계는 공식 분류가 아닌 본 서비스의 자체 기준입니다.</p>
      <div className="item-table-wrap">
        <table className="item-table">
          <thead>
            <tr>
              <th scope="col">단계</th>
              <th scope="col">재차율 구간</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td data-label="단계">여유</td>
              <td data-label="재차율 구간">40% 미만</td>
            </tr>
            <tr>
              <td data-label="단계">보통</td>
              <td data-label="재차율 구간">40% 이상 70% 미만</td>
            </tr>
            <tr>
              <td data-label="단계">혼잡</td>
              <td data-label="재차율 구간">70% 이상 85% 미만</td>
            </tr>
            <tr>
              <td data-label="단계">매우 혼잡</td>
              <td data-label="재차율 구간">85% 이상</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>주차 요금·문의</h2>
      <p>
        주차 요금, 입출차 시간, 목적지별 주차장 안내는{' '}
        <a
          href="https://www.ksponco.or.kr/olympicpark/parkingInfo?mid=a20111000000"
          target="_blank"
          rel="noreferrer noopener"
        >
          올림픽공원 공식 주차 안내
        </a>
        를 참고하세요. 본 서비스는 정보 제공만 하며 주차 예약·정산을 처리하지 않습니다.
      </p>
    </section>
  );
}
