-- 기억법 불량 2편 수정 (memory_tip 만 교체)

update public.sermons set memory_tip = $H$'만일 그리스도인으로 / 고난을 받으면 / 그 이름으로 하나님께 영광을 돌리라' 세 덩어리로 끊어 외워 보세요. 뒤의 '그 이름'은 앞의 '그리스도인'을 다시 가리키는 말이에요. 앞과 뒤를 이어서 떠올리면 문장이 자연스럽게 붙습니다.$H$
 where id = 'YFtktRjB_bw';   -- 벧전 4:16
update public.sermons set memory_tip = $H$앞뒤가 똑같은 모양으로 짝을 이루는 구절이에요. '가이사의 것은 가이사에게 / 하나님의 것은 하나님께'—'○○의 것은 ○○에게' 하나의 틀에 가이사와 하나님만 갈아 끼우면 됩니다. 동전을 손에 드신 예수님을 그리며 두 번 읽어 보세요.$H$
 where id = 'enbDbanMMmc';   -- 막 12:17

select id, mem_ref, length(memory_tip) as 기억법_글자수 from public.sermons where id in ('YFtktRjB_bw','enbDbanMMmc');
